// allow user to click on expandable images, and shows them in a modal

$('.expandable-image').hover(function(){
    $(this).css('cursor', 'pointer');
});

$('.expandable-image').click(function(){
    var image_source = $(this).attr('src');
    $('#expandable-image-modal').show();
    $('#expandable-image-insert').empty();
    $('#expandable-image-insert').append(
        `<img src="${image_source}" style="width: 100%;"/>`
    );
});

$('#expandable-image-modal-close').click(function(){
    $('#expandable-image-modal').hide();
});